# Aze Starter

A public full-stack starter template. Its domain is not commerce — it is the relationship between the people who maintain this repository and the developers who clone it to begin a project of their own.

## Language

**Starter**:
This repository, taken as the thing being distributed rather than the thing being run.
_Avoid_: boilerplate, scaffold, skeleton, seed project

**Adopter**:
A developer who clones the Starter as the beginning of their own project.
_Avoid_: user, consumer, stranger, client

**Platform**:
The parts of the Starter an Adopter keeps and builds upon.
_Avoid_: core, framework, infrastructure

**Demo**:
The parts of the Starter an Adopter reads once and then deletes. Present to show a pattern, never to be extended.
_Avoid_: example, sample, boilerplate, placeholder

**User**:
A person holding credentials in an application built from the Starter. Never the Adopter.
_Avoid_: account, member, customer

**Environment**:
One named place the product runs for an audience — such as qa, uat, prod — ordered by trust. Every environment holds deployments serving Tenants; prod is the one whose Tenants are real. An Environment is never a Tenant.
_Avoid_: stage, cluster, tenant, level

**Tenant**:
A customer of an application built from the Starter, served by that customer's own dedicated deployment. Tenancy lives in operations — one product, many deployments — never inside a deployment, which stays single-Tenant.
_Avoid_: multi-tenant, account, workspace, environment