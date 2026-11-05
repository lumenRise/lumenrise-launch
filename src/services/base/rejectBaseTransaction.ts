const rejectBaseTransaction = (message: string): never => {
  const error = new Error(message);

  error.name = 'InvalidBaseTransaction';

  throw error;
};

export default rejectBaseTransaction;
