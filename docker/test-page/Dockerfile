FROM node:14-alpine

WORKDIR /app/react-autoql/

COPY package*.json .
COPY rollup.config.js .
COPY babel.config.js .
ADD src src

RUN npm ci
RUN npm run build

COPY dist .

WORKDIR /app

COPY example/.package.json .
COPY example/package.json .
COPY example/environments.json .

RUN npm i

ADD example .

EXPOSE 3001

CMD ["npm", "start"]
