import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m12 8-9.04 9.06a2.82 2.82 0 1 0 3.98 3.98L16 12" />
          <circle cx="17" cy="7" r="5" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
