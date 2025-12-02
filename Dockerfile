FROM mcr.microsoft.com/vscode/devcontainers/base:ubuntu

# Install Node.js and npm
RUN apt-get update && apt-get install -y ca-certificates curl gnupg && \
    mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && apt-get install nodejs -y

# Install Spectral CLI
RUN npm install -g @stoplight/spectral-cli

# Copy your rules (already in repo)
WORKDIR /spectral-rules
COPY spectral-level-1.yaml ./

# Make it the default ruleset
ENV SPECTRAL_RULESET=/spectral-rules/spectral-level-1.yaml