// Turns a picked image into a small square JPEG (256 by 256) in the browser before it is uploaded, so uploads are tiny
// and a huge photo never reaches the server. Resolves to a Blob, or throws an Error with a message fit to show.
const SIZE = 256
const MAX_SOURCE_BYTES = 12 * 1024 * 1024
const MAX_OUTPUT_BYTES = 140_000

export async function squareJpeg(file) {
  if (!file || !/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error('Choose a JPEG, PNG, WebP or GIF picture.')
  if (file.size > MAX_SOURCE_BYTES) throw new Error('That picture is too large. Pick one under 12 MB.')
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('That file could not be read as a picture.')
  }
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  // Fill first so transparent pictures get a solid backdrop instead of black.
  ctx.fillStyle = '#16130e'
  ctx.fillRect(0, 0, SIZE, SIZE)
  // Centre-crop to a square.
  const side = Math.min(bitmap.width, bitmap.height)
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE)
  bitmap.close?.()
  for (const quality of [0.9, 0.8, 0.7, 0.55]) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (blob && blob.size <= MAX_OUTPUT_BYTES) return blob
  }
  throw new Error('That picture is too detailed to shrink enough. Try a simpler one.')
}
