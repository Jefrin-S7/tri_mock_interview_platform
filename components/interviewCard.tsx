'use client';

import { getRandomInterviewCover } from "@/lib/utils";
import dayjs from "dayjs";
import Image from "next/image";
import { Button } from "./ui/button";
import Link from "next/link";
import DisplayTechIcons from "./DisplayTechIcons";
import { getFeedbackByInterviewId } from "@/lib/actions/general.action";
import { useEffect, useState } from "react";

const interviewCard = ({ id, userId, role, type, techstack, createdAt }: InterviewCardProps) => {
    const [feedback, setFeedback] = useState<any>(null);
    const [formattedDate, setFormattedDate] = useState('');

    useEffect(() => {
        const loadFeedback = async () => {
            if (userId && id) {
                const result = await getFeedbackByInterviewId({ interviewId: id, userId });
                setFeedback(result);
                const date = dayjs(result?.createdAt || createdAt).format('MMM D, YYYY');
                setFormattedDate(date);
            } else {
                const date = dayjs(createdAt).format('MMM D, YYYY');
                setFormattedDate(date);
            }
        };
        loadFeedback();
    }, [id, userId, createdAt]);

    const normalizedType = /mix/gi.test(type) ? 'Mixed' : type;

  return (
    <div className="card-border w-[360px] max-sm:w-full h-fit">
        <div className="card-interview p-4">
            <div className="absolute top-0 right-0 w-fit px-4 py-2 rounded-bl-lg bg-light-600">
                <p className="badge-text">{normalizedType}</p>
            </div>
            <Image src={getRandomInterviewCover(id)} alt="cover image" width={90} height={90} className="rounded-full object-fit size-[90px]" />
            <h3 className="mt-1 capitalize"> {role} Interview </h3>
            <div className="flex flex-row gap-3 mt-3">
                <div className="flex flex-row gap-2 items-center">
                    <Image src="/icons/calendar.svg" alt="calendar" width={22} height={22} style={{ width: 'auto', height: '22px' }}/>
                    <p>{formattedDate}</p>
                </div>
                <div className="flex flex-row gap-2 items-center">
                    <Image src="/icons/star.svg" alt="star" width={22} height={22} style={{ width: 'auto', height: '22px' }}/>
                    <p>{feedback?.totalScore || '---'}/100</p>
                </div>
            </div>
            <p className="line-clamp-2 mt-2 text-sm">
                {feedback ?.finalAssessment || "You haven't taken this interview yet. Take it now to imporve your skills and get personalized feedback!"}
            </p>
        </div>
        <div className="flex flex-row justify-between items-center mt-3 p-4 pt-0">
            <DisplayTechIcons techStack={techstack} />
            <Button className="btn-primary text-xs p-2 h-auto">
                <Link href={feedback ? `/interview/${id}/feedback` : `/interview/${id}`}>
                    {feedback ? 'Check Feedback' : 'View Interview'}
                </Link>
            </Button>

        </div>
    </div>
  )
}

export default interviewCard