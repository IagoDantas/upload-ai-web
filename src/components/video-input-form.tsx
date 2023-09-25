import { FileVideo, Upload } from "lucide-react";
import { Separator } from "./ui/separator";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { useState, useMemo, FormEvent, useRef } from "react";
import { getFFmpeg } from "@/lib/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { api } from "@/lib/axios";

type Status = "waiting" | "converting" | "uploading" | "generating" | "success";

const statusMessages = {
  waiting: "Carregar video...",
  converting: "Convertendo video...",
  uploading: "Enviando video...",
  generating: "Gerando transcrição...",
  success: "Video carregado com sucesso...",
}


export function VideoInputForm() {
  const [status, setStatus] = useState<Status>('waiting')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const promptInputRef = useRef<HTMLTextAreaElement>(null)

  function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const { files } = event.currentTarget

    if (!files) {
      return
    }

    const selectedFile = files[0]

    setVideoFile(selectedFile)
  }

  async function convertVideoToAudio(videoFile: File) {
    console.log('Convert Started')

    const ffmpeg = await getFFmpeg()

    await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile))

    ffmpeg.on("progress", progress => {
      console.log("Convert Progress: " + Math.round(progress.progress * 100))
    })

    await ffmpeg.exec([
      "-i",
      "input.mp4",
      "-map",
      "0:a",
      "-b:a",
      "20k",
      "-acodec",
      "libmp3lame",
      "output.mp3",
    ])

    const data = await ffmpeg.readFile("output.mp3")

    const audioFileBlob = new Blob([data], { type: "audio/mpeg" })
    const audioFile = new File([audioFileBlob], "audio.mp3", {
      type: "audio/mpeg",

    })

    console.log('Convert Finished')

    return audioFile
  }


  async function handleUploadVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const prompt = promptInputRef.current?.value

    if (!videoFile) {
      return
    }


    setStatus("converting")

    const audioFile = await convertVideoToAudio(videoFile)

    const data = new FormData()

    data.append("file", audioFile)

    setStatus("uploading")

    const response = await api.post("/videos", data)

    const videoId = response.data.video.id

    setStatus("generating")

    await api.post(`/videos/${videoId}/transcription`, {
      prompt
    })

    setStatus("success")
    setInterval(() => {
      setStatus("waiting")
    }, 2000)
  }


  const previewUrl = useMemo(() => {
    if (!videoFile) {
      return null
    }

    return URL.createObjectURL(videoFile)
  }, [videoFile])


  return (
    <form onSubmit={handleUploadVideo} action="" className="space-y-6">
      <label
        htmlFor="video"
        className="relative border flex rounded-md aspect-video cursor-pointer border-dashed text-sm flex-col gap-2 items-center justify-center text-muted-foreground hover:bg-primary/5"
      >
        {previewUrl ? (
          <video src={previewUrl} controls={false} className="pointer-events-none absolute inset-0" />
        ) : (
          <>
            <FileVideo className="h-4 w-4" />
            Selecione um video
          </>
        )}
      </label>
      <input type="file" name="" id="video" accept="video/mp4" className="sr-only" onChange={handleFileSelected} />
      <Separator />
      <div className="space-y-2">
        <Label htmlFor="transcription_prompt">Prompt de transcrição</Label>
        <Textarea
          ref={promptInputRef}
          disabled={status !== "waiting"}
          id="transcription_prompt"
          className="h-20 resize-none leading-relaxed"
          placeholder="Inclua palavras-chave mencionadas no vídeo separadas por virgular (,)"
        />
      </div>
      <Button
        data-success={status === "success"}
        disabled={status !== "waiting"}
        className="w-full data-[success=true]:bg-emerald-400"
        type="submit"
      >
        {status === "waiting" ? (
          <>
            Carregar video
            <Upload className="h-4 w-4" />
          </>
        ) :
          statusMessages[status]
        }
      </Button>
    </form>
  )
}