{{/* The release's base name, truncated to what a label will hold. */}}
{{- define "aze.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "aze.fullname" -}}
{{- $name := include "aze.name" . -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "aze.labels" -}}
app.kubernetes.io/name: {{ include "aze.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
{{- end -}}

{{/*
Where the secrets come from. An Adopter running sealed-secrets or
external-secrets sets `secrets.existingSecret` and the chart stops rendering one
of its own — which is the only way the values below stay out of `values.yaml`
and out of Git.
*/}}
{{- define "aze.secretName" -}}
{{- if .Values.secrets.existingSecret -}}
{{- .Values.secrets.existingSecret -}}
{{- else -}}
{{- printf "%s-secrets" (include "aze.fullname" .) -}}
{{- end -}}
{{- end -}}

{{/* One image reference, so tag and digest are resolved the same way everywhere. */}}
{{- define "aze.image" -}}
{{- $image := index . 0 -}}
{{- $default := index . 1 -}}
{{- if $image.digest -}}
{{- printf "%s@%s" $image.repository $image.digest -}}
{{- else -}}
{{- printf "%s:%s" $image.repository (default $default $image.tag) -}}
{{- end -}}
{{- end -}}
