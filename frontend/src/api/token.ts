let authToken: string | null = null;

export const setApiToken = (token: string | null) => {
  authToken = token;
};

export const getApiToken = () => authToken;
