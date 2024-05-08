FROM node:alpine

WORKDIR /usr/src/app
COPY package.json .
RUN npm i --no-package-lock
COPY index.js index.html ./

CMD [ "node", "." ]
