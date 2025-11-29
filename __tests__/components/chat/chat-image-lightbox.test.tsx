import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { ChatImageLightbox } from "@/components/chat/chat-image-lightbox"

describe("ChatImageLightbox", () => {
  const src = "https://example.com/image.jpg"

  it("renders nothing when closed", () => {
    render(<ChatImageLightbox open={false} onOpenChange={() => { }} src={src} alt="Test image" />)

    expect(screen.queryByAltText("Test image")).toBeNull()
  })

  it("renders the image when open", () => {
    render(<ChatImageLightbox open onOpenChange={() => { }} src={src} alt="Test image" />)

    expect(screen.getByAltText("Test image")).toBeInTheDocument()
  })

  it("calls onOpenChange when ESC key is pressed", () => {
    const handleOpenChange = jest.fn()

    render(<ChatImageLightbox open onOpenChange={handleOpenChange} src={src} alt="Test image" />)

    fireEvent.keyDown(document, { key: "Escape" })

    expect(handleOpenChange).toHaveBeenCalledWith(false)
  })
})


