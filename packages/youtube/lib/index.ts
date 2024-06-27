import { Innertube } from "youtubei.js"

const exit = (message: any, clean: boolean) => {
    if(clean) {
        console.log(message)
        return
    }

    throw new Error(message)
} 

// Retrouser955: Copied from my other library
export async function generateYouTubeCookie() {
    const youtube = await Innertube.create()

    youtube.session.on("auth-pending", (data) => {
        const { verification_url: verify, user_code } = data

        console.log(`Follow this URL: ${verify} and enter this code: ${user_code}\nMake sure you are using a throwaway account to login. Using your main account may result in ban or suspension`)
    })

    youtube.session.on("auth-error", (err) => {
        exit(err.message, false)
    })

    youtube.session.on('auth', (data) => {
        if(!data.credentials) exit("Something went wrong", false)
            
        console.log('Your cookies are printed down below')
        console.log(data.credentials)
    })

    await youtube.session.signIn()
}

export * from "./src/YoutubeExtractor"