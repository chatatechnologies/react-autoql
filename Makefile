PROJECT=$(shell gcloud config get-value project)
CHART_VERSION=v0.0.1
deploy:
	docker build . -t us.gcr.io/$(PROJECT)/duckling-fork
	gcloud docker -- push us.gcr.io/$(PROJECT)/duckling-fork
	gcloud app deploy -q app.yaml --image-url=us.gcr.io/$(PROJECT)/duckling-fork --promote --project=$(PROJECT)

run:
	stack build && stack exec duckling-example-exe
