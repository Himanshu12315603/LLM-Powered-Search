
export default function Auth() {


    function login() {

    }
    return <div>
        <button onClick={()=> login("google")}>Login wiht Google</button>
        <button onClick={()=> login("github")}>Login wiht GitHub</button>
    </div>
}