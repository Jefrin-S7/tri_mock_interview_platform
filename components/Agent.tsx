'use client';

import { interviewer } from '@/constants';
import { createFeedback } from '@/lib/actions/general.action';
import { cn } from '@/lib/utils';
import { vapi } from '@/lib/vapi.sdk';
import Image from 'next/image'
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import FormField from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

enum call_Status {
    INACTIVE = 'INACTIVE',
    CONNECTING = 'CONNECTING',
    ACTIVE = 'ACTIVE',
    FINISHED = 'FINISHED',
}

interface SavedMessage {
    role: 'user' | 'system' | 'assistant';
    content: string;
}

const formSchema = z.object({
  role: z.string().min(1, 'Role is required'),
  level: z.string().min(1, 'Level is required'),
  techstack: z.string().min(1, 'Tech stack is required'),
  type: z.string().min(1, 'Type is required'),
  amount: z.number().min(1, 'Amount must be at least 1').max(20, 'Amount must be at most 20'),
});

type FormData = z.infer<typeof formSchema>;

const Agent = ({ userName, userId, type, interviewId, questions }: AgentProps) => {
    const router = useRouter();
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [callStatus, setCallStatus] = useState<call_Status>(call_Status.INACTIVE);
    const [messages, setMessages] = useState<SavedMessage[]>([]);
    const [micPermission, setMicPermission] = useState<boolean | null>(null);
    const [audioLevel, setAudioLevel] = useState<number>(0);

    // FIX 2: Use a ref for messages so the FINISHED effect always reads the
    // latest transcript without messages being a dep that causes repeated triggers.
    const messagesRef = useRef<SavedMessage[]>([]);
    const addMessage = (msg: SavedMessage) => {
        messagesRef.current = [...messagesRef.current, msg];
        setMessages(messagesRef.current);
    };

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            role: '',
            level: '',
            techstack: '',
            type: '',
            amount: 5,
        },
    });

    const [isGenerating, setIsGenerating] = useState(false);

    const onSubmit = async (data: FormData) => {
        if (isGenerating) return;

        try {
            setIsGenerating(true);
            const response = await fetch('/api/vapi/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...data, userid: userId }),
            });

            const result = await response.json();

            if (result.success) {
                await new Promise(resolve => setTimeout(resolve, 500));
                router.push(`/interview/${result.interviewId}`);
            } else {
                alert('Failed to generate interview: ' + result.error);
                setIsGenerating(false);
            }
        } catch (error) {
            console.error('Error generating interview:', error);
            alert('An error occurred while generating the interview.');
            setIsGenerating(false);
        }
    };

    // FIX 3: VAPI event listeners registered once with [] deps.
    // They read fallbackTTS via ref so they always see the current value.
    useEffect(() => {
        const onCallStart = () => setCallStatus(call_Status.ACTIVE);
        const onCallEnd = () => setCallStatus(call_Status.FINISHED);

        const onMessage = (message: any) => {
            if (message.type === 'transcript' && message.transcriptType === 'final') {
                addMessage({ role: message.role, content: message.transcript });
            }

            if (message.type === 'status-update' && message.status === 'ended') {
                const reason: string = message.endedReason ?? '';

                if (reason.includes('pipeline-error-eleven-labs-blocked-free-plan-and-requested-upgrade')) {
                    alert('Audio provider is unavailable. Please check your VAPI provider configuration.');
                    setCallStatus(call_Status.INACTIVE);
                    return;
                }

                if (reason.includes('ejected')) {
                    setCallStatus(call_Status.INACTIVE);
                    return;
                }

                setCallStatus(call_Status.FINISHED);
            }
        };

        const onSpeechStart = () => setIsSpeaking(true);
        const onSpeechEnd = () => setIsSpeaking(false);

        const onError = (error: any) => {
            // FIX: VAPI sometimes emits empty {} error objects for non-fatal internal events.
            // Guard: if the error has no meaningful content, log and ignore — do NOT kill the call.
            const hasContent =
                error &&
                typeof error === 'object' &&
                Object.keys(error).length > 0;

            if (!hasContent) {
                console.warn('VAPI emitted an empty error object — ignoring (non-fatal).');
                return;
            }

            // Ejection via daily-error — non-fatal, just reset UI
            if (error?.type === 'daily-error' && error?.error?.error?.type === 'ejected') {
                console.warn('VAPI daily-error ejection — resetting call status.');
                setCallStatus(call_Status.INACTIVE);
                return;
            }

            const errMsg = String(
                error?.error?.error?.message ||
                error?.error?.message ||
                error?.message ||
                ''
            );

            // ElevenLabs free-plan block
            if (errMsg.includes('pipeline-error-eleven-labs-blocked-free-plan-and-requested-upgrade')) {
                console.warn('ElevenLabs free plan block detected.');
                setCallStatus(call_Status.INACTIVE);
                alert('Your VAPI audio provider is blocked. Please upgrade or switch providers in your VAPI dashboard.');
                return;
            }

            // Ejection via error message string
            if (errMsg.includes('Meeting ended due to ejection') || errMsg.includes('ejected')) {
                console.warn('VAPI ejection error — resetting call status.');
                setCallStatus(call_Status.INACTIVE);
                return;
            }

            // Only treat as fatal (and kill the call) if we have an actual error message
            if (errMsg.length > 0) {
                console.error('VAPI fatal error:', errMsg, error);
                setCallStatus(call_Status.INACTIVE);
            } else {
                // Non-empty object but no readable message — log only, don't kill the call
                console.warn('VAPI unknown error (non-fatal):', JSON.stringify(error));
            }
        };

        vapi.on('call-start', onCallStart);
        vapi.on('call-end', onCallEnd);
        vapi.on('message', onMessage);
        vapi.on('speech-start', onSpeechStart);
        vapi.on('speech-end', onSpeechEnd);
        vapi.on('error', onError);

        return () => {
            vapi.off('call-start', onCallStart);
            vapi.off('call-end', onCallEnd);
            vapi.off('message', onMessage);
            vapi.off('speech-start', onSpeechStart);
            vapi.off('speech-end', onSpeechEnd);
            vapi.off('error', onError);
        };
    }, []); // safe — reads state via refs

    const checkMicrophonePermission = async () => {
        try {
            if (navigator.permissions) {
                const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
                setMicPermission(permission.state === 'granted');

                permission.addEventListener('change', () => {
                    setMicPermission(permission.state === 'granted');
                });
            } else {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(track => track.stop());
                setMicPermission(true);
            }
        } catch {
            setMicPermission(false);
        }
    };

    // FIX 4: monitorAudioLevels receives the live stream — do NOT stop tracks
    // before calling this. Moved track-stop to happen only after monitoring setup.
    const monitorAudioLevels = (stream: MediaStream) => {
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(stream);

        analyser.fftSize = 256;
        microphone.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let animFrame: number;

        const checkAudioLevel = () => {
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            setAudioLevel(average);
            animFrame = requestAnimationFrame(checkAudioLevel);
        };

        checkAudioLevel();

        setTimeout(() => {
            cancelAnimationFrame(animFrame);
            audioContext.close();
            stream.getTracks().forEach(track => track.stop()); // stop AFTER monitoring
        }, 10000);
    };

    const requestMicrophonePermission = async (): Promise<boolean> => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            monitorAudioLevels(stream); // FIX 4 cont: pass live stream, stops internally
            setMicPermission(true);
            return true;
        } catch {
            setMicPermission(false);
            return false;
        }
    };

    useEffect(() => {
        checkMicrophonePermission();
    }, []);

    const handleGenerateFeedback = useCallback(async (transcript: SavedMessage[]) => {
        if (!transcript || transcript.length === 0) {
            alert('Interview ended early. No feedback data to generate.');
            router.push('/');
            return;
        }

        try {
            const { success, feedbackId: id } = await createFeedback({
                interviewId: interviewId!,
                userId: userId!,
                transcript,
            });

            if (success && id) {
                router.push(`/interview/${interviewId}/feedback`);
            } else {
                router.push('/');
            }
        } catch (error) {
            console.error('Error creating feedback:', error);
            router.push('/');
        }
    }, [interviewId, userId, router]);

    // FIX 5: Read messages from ref so this effect only fires on callStatus change,
    // not every time a new message arrives (which caused repeated feedback calls).
    useEffect(() => {
        if (callStatus !== call_Status.FINISHED) return;

        if (type === 'generate') {
            router.push('/');
        } else if (type === 'interview') {
            const transcript = messagesRef.current;
            if (transcript.length > 0) {
                handleGenerateFeedback(transcript).catch(() => router.push('/'));
            } else {
                alert('Interview ended without recording responses. Please try again.');
                router.push('/');
            }
        }
    }, [callStatus]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleCall = async () => {
        // FIX 6: Validate questions upfront before doing anything
        if (type !== 'generate' && (!questions || questions.length === 0)) {
            alert('No interview questions available. Please go back and try again.');
            return;
        }

        setCallStatus(call_Status.CONNECTING);

        if (micPermission !== true) {
            const granted = await requestMicrophonePermission();
            if (!granted) {
                alert('Microphone permission is required. Please allow access and try again.');
                setCallStatus(call_Status.INACTIVE);
                return;
            }
        }

        try {
            if (type === 'generate') {
                await (vapi.start as any)(undefined, undefined, process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID!);
            } else {
                const formattedQuestions = questions!.map(q => `- ${q}`).join('\n');

                // Destructure out `voice` so we never inherit ElevenLabs-specific
                // fields (stability, similarityBoost, etc.) from the interviewer constant.
                // We always supply our own clean voice config below.
                const { voice: _unusedVoice, ...interviewerWithoutVoice } = interviewer as any;

                const customInterviewer = {
                    ...interviewerWithoutVoice,
                    // Use the built-in vapi provider — no extra properties allowed.
                    voice: {
                        provider: 'vapi',
                        voiceId: 'Elliot',
                    },
                    model: {
                        ...interviewer.model,
                        messages: [
                            {
                                role: 'system',
                                content: `You are a professional job interviewer conducting a real-time voice interview with a candidate. Your goal is to assess their qualifications, motivation, and fit for the role.

Interview Questions to Ask (in order):
${formattedQuestions}

Guidelines:
- Ask these questions one at a time in the order provided
- After each response, acknowledge it and ask follow-up questions if needed for clarity
- Keep responses concise and natural (like real voice conversation)
- Be warm, professional, and welcoming
- If asked questions about the role/company, provide helpful answers
- After you've asked all questions and gotten responses, thank the candidate and end the conversation

Remember: This is a voice conversation, so keep responses short and conversational.`,
                            },
                        ],
                    },
                };

                await (vapi.start as any)(customInterviewer);
            }

            console.log('Call started successfully');
        } catch (error) {
            console.error('Call failed to start:', error);
            setCallStatus(call_Status.INACTIVE);
        }
    };

    const handleDisonnect = () => {
        setCallStatus(call_Status.FINISHED);
        vapi.stop();
    };

    const isCallInactiveOrFinished =
        callStatus === call_Status.INACTIVE || callStatus === call_Status.FINISHED;

    return (
        <>
            {type === 'generate' ? (
                <div className="flex flex-col gap-6 max-w-lg mx-auto">
                    <h2>Generate Interview</h2>
                    <Form {...form}>
                        <form
                            onSubmit={form.handleSubmit(onSubmit)}
                            className="space-y-4"
                            suppressHydrationWarning
                        >
                            <FormField
                                control={form.control}
                                name="role"
                                label="Job Role"
                                placeholder="e.g., Frontend Developer"
                            />
                            <FormField
                                control={form.control}
                                name="level"
                                label="Experience Level"
                                placeholder="e.g., Junior, Mid, Senior"
                            />
                            <FormField
                                control={form.control}
                                name="techstack"
                                label="Tech Stack"
                                placeholder="e.g., React, Node.js, MongoDB"
                            />
                            <FormField
                                control={form.control}
                                name="type"
                                label="Interview Type"
                                placeholder="e.g., Technical, Behavioral"
                            />
                            <FormField
                                control={form.control}
                                name="amount"
                                label="Number of Questions"
                                type="number"
                                placeholder="5"
                            />
                            <Button
                                type="submit"
                                className="btn-primary w-full"
                                disabled={isGenerating}
                            >
                                {isGenerating ? 'Generating...' : 'Generate Interview'}
                            </Button>
                        </form>
                    </Form>
                </div>
            ) : (
                <>
                    <div className='call-view'>
                        <div className='card-interviewer'>
                            <div className='avatar'>
                                <Image
                                    src="/ai-avatar.png"
                                    alt="vapi"
                                    width={65}
                                    height={54}
                                    className='object-cover'
                                />
                                {isSpeaking && <span className="animate-speak" />}
                            </div>
                            <h3>AI Interviewer</h3>
                        </div>
                        <div className='card-border'>
                            <div className='card-content'>
                                <div className='relative'>
                                    <Image
                                        src="/user-avatar.png"
                                        alt="user avatar"
                                        width={540}
                                        height={540}
                                        className='rounded-full object-cover size-[120px]'
                                    />
                                    {micPermission === true && (
                                        <div className='absolute -bottom-2 -right-2 bg-green-500 rounded-full p-1'>
                                            <svg className='w-4 h-4 text-white' fill='currentColor' viewBox='0 0 20 20'>
                                                <path fillRule='evenodd' d='M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z' clipRule='evenodd' />
                                            </svg>
                                        </div>
                                    )}
                                    {micPermission === false && (
                                        <div className='absolute -bottom-2 -right-2 bg-red-500 rounded-full p-1'>
                                            <svg className='w-4 h-4 text-white' fill='currentColor' viewBox='0 0 20 20'>
                                                <path fillRule='evenodd' d='M13.477 14.89A6 6 0 015 9a3 3 0 00-6 0 6 6 0 0010.89 3.477l-1.414-1.414zM7 4a3 3 0 016 0v4a3 3 0 01-.879 2.121l-1.414-1.414A1 1 0 0011 7V4a1 1 0 00-2 0v.879L7.879 3.464A3.001 3.001 0 007 4zM5 9a1 1 0 00-2 0 4 4 0 008 0 1 1 0 00-2 0 2 2 0 01-4 0z' clipRule='evenodd' />
                                            </svg>
                                        </div>
                                    )}
                                    {callStatus === call_Status.ACTIVE && (
                                        <div className='absolute -top-2 -right-2'>
                                            <div className='flex space-x-1'>
                                                {[...Array(5)].map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className={`w-1 bg-green-500 rounded-full transition-all duration-200 ${audioLevel > i * 20 ? 'h-4' : 'h-1'}`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <h3>{userName}</h3>
                            </div>
                        </div>
                    </div>

                    {(callStatus === call_Status.ACTIVE || messages.length > 0) && (
                        <div className='transcript-border'>
                            <div className='transcript'>
                                {messages.length === 0 ? (
                                    <p className='text-gray-500 text-center py-4'>
                                        Waiting for conversation to start...
                                    </p>
                                ) : (
                                    <div className='w-full space-y-2 max-h-60 overflow-y-auto'>
                                        {messages.map((msg, index) => (
                                            <div
                                                key={index}
                                                className={cn(
                                                    'p-2 rounded-lg text-sm text-white',
                                                    msg.role === 'assistant'
                                                        ? 'bg-blue-900/30 ml-4'
                                                        : 'bg-gray-700/30 mr-4'
                                                )}
                                            >
                                                <span className='font-semibold capitalize'>
                                                    {msg.role}:{' '}
                                                </span>
                                                {msg.content}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className='w-full flex justify-center'>
                        {micPermission === false && (
                            <div className='mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-center'>
                                <p className='text-sm'>
                                    Microphone access is required for calls. Please allow microphone
                                    permission in your browser.
                                </p>
                                <button
                                    onClick={requestMicrophonePermission}
                                    className='mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm'
                                >
                                    Allow Microphone
                                </button>
                            </div>
                        )}

                        {callStatus !== call_Status.ACTIVE ? (
                            <button
                                className='relative btn-call'
                                onClick={handleCall}
                                disabled={micPermission === false}
                            >
                                <span
                                    className={cn(
                                        'absolute animate-ping rounded-full opacity-75',
                                        callStatus !== 'CONNECTING' && 'hidden'
                                    )}
                                />
                                <span>{isCallInactiveOrFinished ? 'call' : '. . .'}</span>
                            </button>
                        ) : (
                            <button className='btn-disconnect' onClick={handleDisonnect}>
                                End
                            </button>
                        )}
                    </div>
                </>
            )}
        </>
    );
};

export default Agent;