def log_in(response, posting):
    posting.set_variable("bearer_token", response.json()['accessToken'])
    posting.set_variable("refresh_token", response.json()['refreshToken'])

def create_vault(response, posting):
    posting.set_variable("vault_id", response.json()['publicId'])

def create_secret(response, posting):
    posting.set_variable("secret_id", response.json()['publicId'])

def create_role(response, posting):
    posting.set_variable("role_id", response.json()['publicId'])

def create_auth_method(response, posting):
    posting.set_variable("auth_method_id", response.json()['publicId'])

def create_token(response, posting):
    posting.set_variable("auth_method_id", response.json()['publicId'])
