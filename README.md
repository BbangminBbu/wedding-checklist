# 우리의 결혼준비 체크리스트 💍

결혼 준비 항목 체크, 비용 정리, D-day, 정한 업체 모아보기를 한 곳에서 관리하는 웹앱입니다.
서버 없이 동작하며, 입력한 내용은 각자의 브라우저(localStorage)에만 저장됩니다.

## 파일 구성
- `index.html` : 화면 구조
- `style.css` : 디자인
- `app.js` : 기능(체크리스트, 비용, D-day, 저장)
- `.nojekyll` : GitHub Pages 설정용 빈 파일
- `README.md` : 이 문서

## GitHub Pages 배포 방법
1. GitHub에서 New repository로 저장소를 만든다 (Public, 이름 예: `wedding-checklist`).
2. Add file → Upload files 로 위 파일 전부를 저장소 최상위에 올리고 Commit 한다.
3. Settings → Pages → Build and deployment 에서 Source를 `Deploy from a branch`, Branch를 `main` / `/ (root)` 로 선택하고 Save 한다.
4. 1~2분 뒤 `https://내아이디.github.io/wedding-checklist/` 주소로 접속된다.
