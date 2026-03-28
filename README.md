# 판독 인센티브 계산기

EMR 스크린샷을 업로드하면 AI가 이로운 교수의 판독 건수를 자동 추출하고 인센티브를 계산합니다.

## Vercel 배포 방법

### 1. GitHub 저장소 생성
```bash
cd incentive-calculator
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/incentive-calculator.git
git push -u origin main
```

### 2. Vercel 배포
1. [vercel.com](https://vercel.com) 접속 → GitHub 로그인
2. "Add New Project" → 위 저장소 선택
3. **Environment Variables** 설정:
   - `ANTHROPIC_API_KEY` = `sk-ant-xxxxxx` (Anthropic API 키)
4. "Deploy" 클릭

### 3. 완료!
배포된 URL (예: `https://incentive-calculator.vercel.app`)에서 바로 사용 가능합니다.

## 로컬 개발
```bash
npm install
cp .env.local.example .env.local
# .env.local에 API 키 입력
npm run dev
```
http://localhost:3000 에서 확인

## 단가 수정
`app/page.js` 파일 상단의 `RATES` 객체에서 단가를 수정할 수 있습니다.
