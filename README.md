# Enigma

My cost effective secrets management solution.

> [!WARNING]
> This project is not intended to be a production ready solution. It is a
> service I use for my own side projects. I am open sourcing the code for
> educational purposes and for my portfolio.

## Description

For my side projects, I have been using docker deployments to various cloud
VMs. I needed a way to manage secrets (API keys, database passwords, etc) and
was tired of manually managing docker secrets and having to update my application
to support loading secrets from files, which I believe too tightly couples the
application to its deployment environment. Having a centralized secrets manager
that is within my control is important to me, and Enigma is the result.

I am open sourcing the code in case it is useful to others, but it is not
really intended to be a production ready solution, though it could become that
in the future. I run this in "production" for my own side projects because it 
makes my deployments easier.

### Features

* Simple HTTP API for managing vaults, secrets, and access control.
* Role-based access control (RBAC) for vault permissions.
  * Token authentication
  * CIDR whitelisting
  * mTLS (coming soon)
* Supports cloud provider key management services (KMS) for encrypting vault
keys and secrets at rest.
  * Local key (for development/testing)
  * AWS
  * GCP (coming soon)
  * Azure (coming soon)
* Docker container deployment

## Documentation

The API documentation as it exists today is largely contained within the code
and the generated OpenAPI spec. If there is a desire for more formal documentation,
I can work on that in the future.

There is also a `posting` request collection in the `./requests` directory that 
can be used to explore the API interactively.

```bash
posting --collection requests --env requests/_env/local.env
```

## AI Philosphy

I used AI tools to help me write and refine the code for this project. In
general, I used AI to assit me with:

* Generating initial boilerplate and project structure
* Writing unit tests
* Perfoming "code reviews" to identify logical gaps or potential bugs

Things I did myself:

* Design and architect the project
* Write the core business logic
* Manual integration testing and debugging
* Final review and polishing of all code

I found that using AI tools in this way greatly accelerated my development
process, allowing me to focus on higher level design and problem solving while
letting the AI handle more routine coding tasks. However, I made sure to
carefully review and test all AI-generated code to ensure correctness and
quality.
