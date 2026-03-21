"use client";

import Image from "next/image" 

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button"
import {Form,} from "@/components/ui/form"
import Link from "next/link";
import { error } from "console";
import { toast, Toaster } from "sonner";
import FormField from "./FormField";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebase/client";
import { signIn, signUp } from "@/lib/actions/auth.action";


const authformSchema = (type: FormType) => {
  return z.object({
    name: type === "sign-up" ? z.string().min(3) : z.string().optional(),
    email: z.string().email(),
    password: z.string().min(6),
     })
}


const AuthForm = ({ type }: { type: FormType }) => {
  const router = useRouter();
  const formSchema = authformSchema(type);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",

    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      if (type === "sign-up") {
        const { name, email, password} = values;

        const userCredentials = await createUserWithEmailAndPassword(auth, email, password);

        const result = await signUp({
          uid: userCredentials.user.uid,
          name: name!,
          email,
          password,
        })

        if(!result ?.success) {
          toast.error(result ?.message);
          return;
        }

        toast.success("Account created successfully. Please Sign in to continue.")
        router.push("/sign-in");
      } else {
        const { email, password } = values;

        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        const idToken = await userCredential.user.getIdToken();

        if(!idToken) {
          toast.error('Sign in failed')
          return;
        }

        await signIn({
          email, idToken
        })


        toast.success("Signed in successfully. Redirecting to dashboard...")
        router.push("/");
      }

    } catch (error) {
      console.log(error);
      toast.error("Something went wrong.Please Try again Later: ${error}")
    }

    
  }

  const isSignIn = type === "sign-in";

  return (
    <div className="card-border lg:min-w-[566px]">
      <div className="flex flex-col gap-6 card py-14 px-10">
        <div className="flex flex-row gap-2 justify-center">
          <Image src="/logo.svg" alt="logo" height={32} width={32} style={{ width: 'auto', height: 'auto' }}/>
          <h2 className="text-primary-100">NextRound-Ai</h2>
        </div>
        <h3>Practice job interviews with AI</h3>
      
      <Form { ... form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-6 mt-4 form">
          {!isSignIn && (
          <FormField 
            control={form.control} 
            name="name" 
            label="Name" 
            placeholder="Your Name" />
          )}
                    <FormField 
            control={form.control} 
            name="email" 
            label="Email" 
            placeholder="your@email.com"
            type="email" />
            
                    <FormField 
            control={form.control} 
            name="password" 
            label="Password" 
            placeholder="enter your Password" 
            type="password"/>
          
          <Button className="btn" type="submit">{isSignIn ? 'Sign In' : 
            'Create an Account'}</Button>
        </form>
      </Form>

      <p className="text-center">
        {isSignIn ? "Don't have an account?" : "Already have an account?"}
        <Link href={!isSignIn ? '/sign-in': '/sign-up'} className="font-bold text-user-primary ml-1">
        {!isSignIn ? "Sign in" : "Sign up"}
        </Link>

      </p>
    </div>
    </div>
  )
}

export default AuthForm