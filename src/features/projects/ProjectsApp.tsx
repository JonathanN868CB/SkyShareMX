import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { BoardList } from "./components/BoardList"
import { BoardView } from "./components/BoardView"

export default function ProjectsApp() {
  const { boardId } = useParams<{ boardId?: string }>()
  const navigate = useNavigate()

  function selectBoard(id: string) {
    navigate(`/app/projects/${id}`)
  }

  function goBack() {
    navigate("/app/projects")
  }

  if (boardId) {
    return <BoardView boardId={boardId} onBack={goBack} />
  }

  return <BoardList onSelectBoard={selectBoard} />
}
