import axios from "axios";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js/dist/index.cjs";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { BACKEND_URL } from "@/lib/config";

const supabase = createClient();

export default function Dashboard() {
    const [user, setUser] = useState<User | null>(null);
    const navigate = useNavigate();
    
    useEffect(() => {
        async function getInfo() {
            const { data, error } = await supabase.auth.getUser();
            if(data.user) {
                setUser(data.user);
            }
        }
        getInfo();
    }, []);

    useEffect(() => {
        async function getExistingConversations() {
            if(user) {
                const {data: {session}} = await supabase.auth.getSession();
                const jwt = session?.access_token;
                const response = await axios.get(`${BACKEND_URL}/conversations`, {
                    headers: {
                        Authorization: jwt
                    }
                });
                console.log(response.data);
            }
        }
        getExistingConversations();
    }, [user]);

    return <div>
        {!user && <button onClick={()=> {
            navigate("/Auth");
        }}>Sign in</button>}

        {user && <div>
            {user.email}
            <button onClick={() => { 
                supabase.auth.signOut();
                setUser(null);
             }}>Logout</button>
        </div>
        }
    </div>
}
