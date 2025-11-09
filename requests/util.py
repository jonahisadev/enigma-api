def log_in(response, posting):
    posting.set_variable("bearer_token", response.json()['accessToken'])
    posting.set_variable("refresh_token", response.json()['refreshToken'])

def create_vault(response, posting):
    posting.set_variable("vault_id", response.json()['publicId'])
