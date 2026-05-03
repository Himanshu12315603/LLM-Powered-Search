import { createClient } from "@/lib/supabase/client";
const supabase = createClient();


export default function Auth() {

    async function login(provider: "google" | "github") {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: provider
        });

        if (error) {
            alert("Error while signing in: " + error.message);
        }
        else {
            alert("signed in");
        }
    }


    return <div>
        <button onClick={() => login("google")}>Login wiht Google</button>
        <button onClick={() => login("github")}>Login wiht GitHub</button>
    </div>
}