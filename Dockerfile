FROM node:8

ENV NODE_ENV=production
ENV PORT=5000

COPY ./node_modules/@tobi/connector/certs /app/certs
RUN cat /app/certs/SAPNetCA_G2.crt >> /etc/ssl/certs/ca-certificates.crt

COPY ./node_modules /app/node_modules
COPY ./package.json /app/package.json
COPY ./dist /app/dist
WORKDIR /app

ENTRYPOINT ["node","dist/index.js"]
