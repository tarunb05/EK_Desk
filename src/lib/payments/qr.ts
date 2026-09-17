import QRCode from "qrcode";

// Server-side only, rendered once per pay-page request into inline SVG
// markup -- zero client JS for it. QRCode.toString's callback API is
// wrapped in a promise since this project's own convention (async/await
// throughout) doesn't otherwise use Node-style callbacks.
export function renderQrSvg(data: string): Promise<string> {
  return new Promise((resolve, reject) => {
    QRCode.toString(
      data,
      { type: "svg", margin: 1 },
      (error, svg) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(svg);
      },
    );
  });
}
