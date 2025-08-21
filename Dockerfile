FROM node:22.12.0-alpine

WORKDIR /app

COPY package.json ./
COPY yarn.lock ./

RUN yarn install

COPY . .

RUN yarn build

EXPOSE 5001

ENV NODE_ENV=development
ENV PORT=5001

CMD ["yarn", "start:prod"]