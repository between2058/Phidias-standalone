FROM node:20-alpine

ARG BUILD_FOLDER=""
ENV DOCKER_BUILD_FOLDER=${BUILD_FOLDER}
ARG INSTALL_PATH=/app
ADD ${DOCKER_BUILD_FOLDER} ${INSTALL_PATH}

RUN mkdir -p /opt/scripts
WORKDIR /app
ENV http_proxy=http://proxy.intra:80
ENV https_proxy=http://proxy.intra:80
ENV HTTP_PROXY=http://proxy.intra:80
ENV HTTPS_PROXY=http://proxy.intra:80

RUN npm config set proxy http://proxy.intra:80
RUN npm config set https-proxy http://proxy.intra:80

RUN npm install -g pnpm@10.2.0

# Install dependencies and build the next app
RUN pnpm install
RUN pnpm run build

RUN unset http_proxy
RUN unset https_proxy
RUN unset HTTP_PROXY
ENV WDS_SOCKET_PORT=0

EXPOSE 3002

# Next.js standalone start
CMD ["pnpm", "start"]
