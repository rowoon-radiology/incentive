import "./globals.css";

export const metadata = {
  title: "판독 인센티브 계산기",
  description: "EMR 스크린샷 → AI 분석 → 이로운 판독량 자동 추출",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&family=JetBrains+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
