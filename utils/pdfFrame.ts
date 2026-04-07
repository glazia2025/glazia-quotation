function waitForFrameLoad(frame: HTMLIFrameElement) {
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    frame.onload = () => finish();
    window.setTimeout(() => finish(), 500);
  });
}

function waitForImages(doc: Document) {
  const images = Array.from(doc.images).filter((image) => !image.complete);

  if (images.length === 0) {
    return Promise.resolve();
  }

  return Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          image.onload = () => resolve();
          image.onerror = () => resolve();
        })
    )
  ).then(() => undefined);
}

export async function createPdfFrame(html: string) {
  console.log("[quotation-pdf] createPdfFrame start");
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.src = "about:blank";
  frame.style.position = "fixed";
  frame.style.top = "-10000px";
  frame.style.left = "0";
  frame.style.width = "297mm";
  frame.style.height = "210mm";
  frame.style.opacity = "0";
  frame.style.pointerEvents = "none";
  document.body.appendChild(frame);

  await waitForFrameLoad(frame);
  console.log("[quotation-pdf] iframe ready");

  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    throw new Error("Unable to create PDF document frame.");
  }

  doc.open();
  doc.write(html);
  doc.close();
  console.log("[quotation-pdf] iframe html written", { imageCount: doc.images.length });

  await waitForImages(doc);
  console.log("[quotation-pdf] iframe images ready");

  if ("fonts" in doc) {
    try {
      await (doc as Document & { fonts: FontFaceSet }).fonts.ready;
      console.log("[quotation-pdf] iframe fonts ready");
    } catch {
      // Ignore font loading failures and continue with the default stack.
      console.warn("[quotation-pdf] iframe fonts failed");
    }
  }

  await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
  console.log("[quotation-pdf] createPdfFrame complete");

  return {
    doc,
    body: doc.body as HTMLBodyElement,
    cleanup: () => {
      frame.remove();
    }
  };
}
