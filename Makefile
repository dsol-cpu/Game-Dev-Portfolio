SHELL := /bin/ksh

# Separate environment files
ENV_FRONTEND := --env-file ./src/front_end/.env.dev
ENV_BACKEND := --env-file ./src/back_end/.env.dev

build: down
	podman-compose $(ENV_FRONTEND) $(ENV_BACKEND) build

build-frontend:
	podman-compose $(ENV_FRONTEND) build frontend

build-backend:
	podman-compose $(ENV_BACKEND) build backend

up: build
	podman-compose $(ENV_FRONTEND) $(ENV_BACKEND) up

up-frontend:
	podman-compose $(ENV_FRONTEND) up frontend --no-deps

up-backend:
	podman-compose $(ENV_BACKEND) up backend --no-deps

down:
	podman-compose $(ENV_FRONTEND) $(ENV_BACKEND) down

down-frontend:
	podman-compose $(ENV_FRONTEND) down frontend

down-backend:
	podman-compose $(ENV_BACKEND) down backend

clean: down
	podman system prune -f

pod-create:
	if ! podman pod exists portfolio-pod; then \
		podman pod create --name portfolio-pod -p 5173:5173 -p 10000:10000; \
	fi

pod-build: pod-create
	podman build $(ENV_FRONTEND) -t frontend -f src/front_end/Dockerfile .
	podman build $(ENV_BACKEND) -t backend -f src/back_end/Dockerfile .

pod-run:
	$(MAKE) pod-create
	# Ensure containers are removed if they exist
	podman rm -f frontend || true
	podman rm -f backend || true
	# Run containers with the --replace flag to ensure they are replaced
	podman run -d --rm --pod portfolio-pod \
		$(ENV_FRONTEND) \
		--name frontend frontend
	podman run -d --rm --pod portfolio-pod \
		$(ENV_BACKEND) \
		--name backend backend

pod-run-frontend:
	$(MAKE) pod-create
	# Ensure container is removed if it exists
	podman rm -f frontend || true
	# Run frontend container with the --replace flag
	podman run -d --rm --pod portfolio-pod \
		$(ENV_FRONTEND) \
		--name frontend frontend

pod-run-backend:
	$(MAKE) pod-create
	# Ensure container is removed if it exists
	podman rm -f backend || true
	# Run backend container with the --replace flag
	podman run -d --rm --pod portfolio-pod \
		$(ENV_BACKEND) \
		--name backend backend

pod-stop:
	podman pod stop portfolio-pod

pod-down: pod-stop
	podman pod rm portfolio-pod

kube-up:
	if ! kubectl get namespace portfolio >/dev/null 2>&1; then \
		kubectl apply -f k8s/namespace.yaml; \
	fi
	echo "Checking namespace 'portfolio' status..."
	sleep 2 # Small delay to allow status update
	if [ "$(kubectl get namespace portfolio -o jsonpath='{.status.phase}')" = "Active" ]; then \
		echo "Namespace 'portfolio' is Active."; \
	else \
		echo "Waiting for namespace 'portfolio' to become Active..."; \
		kubectl wait --for=condition=Active namespace/portfolio --timeout=60s || { \
			echo "Namespace 'portfolio' did not become Active within timeout."; exit 1; \
		} \
	fi
	kubectl apply -f k8s/

kube-down:
	kubectl delete namespace portfolio
