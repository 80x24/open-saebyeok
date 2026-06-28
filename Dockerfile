# relay 배포용 — 외부 상시 서버(Fly 등). MODE=relay 로 메신저 입구만 쥐고 worker 에 위임.
# relay 는 정체성·기억(데이터)이 필요 없다(처리는 로컬 worker 가 한다) → bot/ 코드만 담는다.
FROM oven/bun:1

WORKDIR /app
COPY bot/package.json ./bot/
RUN cd bot && bun install

COPY bot ./bot

ENV MODE=relay
# 배포 시 secret 으로 주입: REDIS_URL, CHANNEL, 메신저 토큰(SLACK_*/TELEGRAM_*), RELAY_TIMEOUT_SEC
CMD ["bun", "run", "bot/index.ts"]
