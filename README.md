# Nothing

By shipping software that does nothing, you’ve figured out how to ship the 
_right_ something, sooner.

> Kerick Long, [Ship Software That Does Nothing](https://kerrick.blog/articles/2025/ship-software-that-does-nothing/)


## Configuration

### VPS

Before running the script below:

1. Provision a VPS
2. Copy the SSH key to the VPS root user
3. Add a DNS A record for the VPS IP address

To set up the VPS, run the following command as root on the remote server:

```bash
curl -1sLf 'https://scripts.byjonah.net/nothing.sh' -o nothing.sh

# Read script to validate :)

chmod +x nothing.sh
bash nothing.sh
```

### Github

There are two actions for this project to start:

1. CI - Runs on every push to all branches to validate the code and run tests.
2. Release - Deploys the current code to the VPS.

The release will push a new docker image to the GHCR registry and then use
docker stack to deploy the new image to the VPS.

### Docker

In order to effectively deploy this project, the app should be dockerized. If
there are multiple services in the project, new job steps will need to be added
to the deploy scripts so more than one image can be pushed and deployed.
