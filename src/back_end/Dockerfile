# Stage 1: Builder
FROM docker.io/rust:latest AS builder

# Set environment variables for non-root user creation
ENV USER=web
ENV UID=1001

# Create a non-root user with no home directory or shell access
RUN adduser --disabled-password --home "/nonexistent" --shell "/usr/sbin/nologin" \
    --no-create-home --uid "${UID}" "${USER}"

# Set the working directory
WORKDIR /app

# Update apt sources list to use bookworm
RUN echo "deb http://deb.debian.org/debian bookworm main" > /etc/apt/sources.list \
    && echo "deb http://deb.debian.org/debian bookworm-updates main" >> /etc/apt/sources.list \
    && echo "deb http://security.debian.org/debian-security bookworm-security main" >> /etc/apt/sources.list

# Install dependencies including curl (for Cargo Chef)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y \
    && export PATH="$HOME/.cargo/bin:$PATH" \
    && cargo install cargo-chef \
    && cargo install sccache
    # Install sccache if you're using it

# If you want to disable sccache, uncomment the following line:
# ENV RUSTC_WRAPPER= ""

# Set the working directory
WORKDIR /app

# Copy Cargo.toml and Cargo.lock for dependency resolution
COPY src/back_end/Cargo.toml src/back_end/Cargo.lock ./

# Initialize the cargo chef plan to cache dependencies
# RUN cargo chef prepare --recipe-path recipe.json

# Now copy the source code
COPY src/back_end/ ./

# Build dependencies with cargo chef
# RUN cargo chef cook --recipe-path recipe.json

# Finally, build the application
RUN cargo build -j $(nproc)

# Stage 2: Slim Image
FROM debian:bookworm-slim

# Update apt sources list to use bookworm
RUN echo "deb http://deb.debian.org/debian bookworm main" > /etc/apt/sources.list \
    && echo "deb http://deb.debian.org/debian bookworm-updates main" >> /etc/apt/sources.list \
    && echo "deb http://security.debian.org/debian-security bookworm-security main" >> /etc/apt/sources.list

# Install necessary runtime dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Copy the non-root user and group info from the builder stage
COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /etc/group /etc/group

# Set the working directory
WORKDIR /app

# Copy the built executable from the builder stage
COPY --from=builder /app/target/debug/back_end ./

# Use the non-root user created in the builder stage
USER web:web

# Expose the application port
EXPOSE 10000
ENV RUST_BACKTRACE=1
# Set the default command
CMD ["./back_end"]
