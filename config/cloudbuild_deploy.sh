#!/usr/bin/env bash
# Sherman 202010 v0.1
# this code used to deploy in cloud build

# todo
# backup  restore env
# https://unix.stackexchange.com/questions/209895/unset-all-env-variables-matching-proxy
# all variables use prefix

set -xve
shopt -s nocasematch

function setSectionEnv() {
    #awk -v s="[$section]" '/\[[^]]*\]/{a=$1;next} NF{gsub("=", " "); if (a==s) {print "export",$1"="$2 }}' $temp_ini >$sec_file
    awk -v s="[$section]" '/\[[^]]*\]/{a=$1;next} NF{if (a==s) {print "export",$0}}' $temp_ini >$sec_file
    source ./$sec_file
    export deployName=$section

    if [[ $cloud == "gcp" ]]; then
        if [[ $cloud_project == "staging" ]]; then
            HELM_CONFIG_FILE='stag-values.yaml'
            GKE_CLUSTER='net-staging'
            COMPUTE_ZONE='us-east1-b'

        elif [[ $cloud_project == "production" ]]; then
            HELM_CONFIG_FILE='prod-values.yaml'
            GKE_CLUSTER='net-production'
            COMPUTE_ZONE='us-east1-b'

        else
            echo "The project name should be staging or production"
            return 1
        fi

    elif [[ $cloud == "azure" ]]; then
        if [[ $cloud_project == "staging" ]]; then
            HELM_CONFIG_FILE='stag-values.yaml'
            AKS_CLUSTER='chata-k8s-cluster'
            COMPUTE_ZONE='Canada Central'
            RESOURCE_GROUP='rg-chata-Applications'

        elif [[ $cloud_project == "production" ]]; then
            HELM_CONFIG_FILE='prod-values.yaml'
            AKS_CLUSTER='azure-production'
            COMPUTE_ZONE='Canada Central'
            RESOURCE_GROUP='rg-kubernetes'

        else

            echo "The project name should be staging or production"
            return 1
        fi

    else
        echo "The cloud name should be gcp or azure"
        return 1
    fi

    if [[ $cloud == "gcp" ]]; then

        gcloud container clusters get-credentials $GKE_CLUSTER --zone $COMPUTE_ZONE

    elif [[ $cloud == "azure" ]]; then

        az login --service-principal --username $azure_sp_username --tenant $azure_sp_tenantid --password $azure_sp_secret
        az aks get-credentials --name=$AKS_CLUSTER --resource-group=$RESOURCE_GROUP --overwrite-existing

    else
        echo "The cloud environment should be gcp or azure"
        return 1
    fi

    NAMESPACE=$(grep "namespace: " <./config/$HELM_CONFIG_FILE | awk '{print $2}')
    kubectl config set-context "$(kubectl config current-context)" --namespace="$NAMESPACE"

}

if [ -z "$TAG_NAME" ]; then
    echo "This commit will not be deployed. Please push a tag in order to deploy."
    exit 0
else

    _SLACK_WEBHOOK_URL=$cloudbuild_slack_token
    echo $PROJECT_ID

    case $PROJECT_ID in
    'staging-245514')
        cloud_project='staging'
        HELM_REPO_URL='gs://chata-caas-helm-repo-dev'
        DEPLOY_CONFIG_FILE='stag-config.ini'
        ;;
    'production-245514')
        cloud_project='production'
        HELM_REPO_URL='gs://chata-caas-helm-repo'
        DEPLOY_CONFIG_FILE='prod-config.ini'
        ;;
    esac

    temp_ini="temp.ini"
    sec_file="section.txt"
    releaseId="id$(date "+%Y%m%d%M%S")"

    # remove comments
    sed -e '/^[[:space:]]*#.*$/d;/^[[:space:]]*$/d' ./config/$DEPLOY_CONFIG_FILE >$temp_ini

    # get all sections
    sections=$(sed -n 's/^[ \t]*\[\(.*\)\].*/\1/p' $temp_ini)

    for section in $sections; do
        setSectionEnv
        [ -f "./Makefile" ] && CHART_VER=$(grep "CHART_VERSION=" <./Makefile | sed 's/CHART_VERSION=v//1')
        [ -f "./build.gradle" ] && CHART_VER=$(sed -e 's/[v\s"]//g' <<<"$(cat ./build.gradle | grep "^project.ext.chartVersion" | cut -d '=' -f2 | tr -d ' ')")
        [ -f "./build.gradle.kts" ] && CHART_VER=$(sed -e 's/[v\s"]//g' <<<"$(cat ./build.gradle.kts | grep "val project_chartVersion" | cut -d '=' -f2 | tr -d ' ')")

        if [[ -z "$CHART_VER" ]]; then
            echo Cannot Find Chart Version
            exit 1
        fi

        set +e
        helm plugin install https://github.com/hayorov/helm-gcs.git --version 0.3.5
        set -e
        helm repo add chata $HELM_REPO_URL
        helm repo up

        awk '{ for (v in ENVIRON) {gsub("\${"v"}",ENVIRON[v])}; print $0}' ./config/$HELM_CONFIG_FILE >helm.yaml
        if err=$(grep -E '\$\{\w+\}' helm.yaml); then
            echo "Missing variable in config file: config/$DEPLOY_CONFIG_FILE secion: [$section], variables:$err"
            exit 1
        fi

        # max length is 53
        new_release="${section:0:53}"
        if [[ ${#section} -gt 53 ]]; then
            new_release=${new_release%-}
        fi

        RELEASE=$(helm ls --filter "^$new_release$" | awk -F " " 'NR>1 {print $1}')

        # if [[ -z "$RELEASE" ]]; then
        #     # check if it old deployment, this will be only happend for the first time
        #     RELEASE=$(helm ls --deployed "^$(echo "$section" | cut -d'-' -f -2)" | awk '{if (NR!=1) {print $1}}')
        #     if [[ -n "$RELEASE" ]]; then
        #         helm del --purge "$RELEASE" #have to delete the old deployment since cannot change labels
        #         RELEASE=""
        #     fi
        # fi
        # check release not find or more than one
        if (($(echo "$RELEASE" | grep -c .) > 1)); then
            echo "Find more than one release: $RELEASE for $section, please check"
            exit 1
        fi

        [[ $_DEBUG != "true" ]] && curl -X POST -H 'Content-Type: application/json' --data '{"text":"'$cloud' '$cloud_project': BEGINNING deploy of a new version of `'$section'` from `'$PROJECT_ID/$REPO_NAME:$TAG_NAME'`"}' $_SLACK_WEBHOOK_URL

        if [ -f "./config/cloudbuild_build.sh" ]; then
            # different images
            image_name=$section
        else
            # same image
            image_name=$REPO_NAME
        fi

        if [[ -z "$RELEASE" ]]; then
            RELEASE=$new_release
            helm install $RELEASE chata/$REPO_NAME --namespace $NAMESPACE --version $CHART_VER --set fullnameOverride=$section,image.repository=us.gcr.io/$PROJECT_ID/$image_name,image.tag=$TAG_NAME,app=$app,releaseId=$releaseId -f helm.yaml $([[ "$_DEBUG" == "true" ]] && echo "--dry-run")
        else
            helm upgrade --install $RELEASE chata/$REPO_NAME --namespace $NAMESPACE --version $CHART_VER --set fullnameOverride=$section,image.repository=us.gcr.io/$PROJECT_ID/$image_name,image.tag=$TAG_NAME,app=$app,releaseId=$releaseId -f helm.yaml $([[ "$_DEBUG" == "true" ]] && echo "--dry-run")
        fi

    done

    if [[ "$_DEBUG" != "true" ]]; then
        set +e
        has_error="false"
        SECONDS=0
        max_waiting_time=1200 #max wait 1200 seconds
        for section in $sections; do
            setSectionEnv
            check_timeout=$((max_waiting_time - $SECONDS))
            if ((check_timeout < 20)); then
                check_timeout=20
            fi

            kubectl rollout status deploy $section --namespace="$NAMESPACE" --timeout=$check_timeout"s"
            result=$?

            if [ $result != 0 ]; then
                has_error="true"

                [[ $_DEBUG != "true" ]] && curl -X POST -H 'Content-Type: application/json' --data '{"text":":broken_heart: '$cloud' '$cloud_project': DEPLOY FAILED! `'$section'` from `'$PROJECT_ID/$REPO_NAME:$TAG_NAME'`"}' $_SLACK_WEBHOOK_URL
                [[ $_DEBUG != "true" ]] && curl -X POST -H 'Content-Type: application/json' --data '{"text":":pill: '$cloud' '$cloud_project': Re-deploy or rollback by batch_rollback ```switch_gcp'\\n'batch_rollback '$releaseId'```"}' $_SLACK_WEBHOOK_URL
            else
                [[ $_DEBUG != "true" ]] && curl -X POST -H 'Content-Type: application/json' --data '{"text":":white_check_mark: '$cloud' '$cloud_project': DEPLOY SUCCEEDED! `'$section'` from `'$PROJECT_ID/$REPO_NAME:$TAG_NAME'`"}' $_SLACK_WEBHOOK_URL
            fi

        done
        [[ $has_error == "true" ]] && exit 1

        exit 0
    fi

fi
