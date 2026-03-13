// /Users/mphelps/Documents/repos/usx_app/interface/src/store/middleware/errorLoggingMiddleware.js
import { logErrorToServer } from '../../utils/errorLogger';

const errorLoggingMiddleware = (store) => (next) => (action) => {
  if (action.type && action.type.endsWith('/rejected')) {
    const error = action.error; // Standard error object from createAsyncThunk
    const payload = action.payload; // Sometimes backend sends more details in payload on error

    let errorMessage = 'API Error';
    if (error && error.message) {
      errorMessage = error.message;
    } else if (typeof payload === 'string') {
      errorMessage = payload;
    } else if (payload && payload.message) {
      errorMessage = payload.message;
    }

    const errorToLog = new Error(errorMessage);
    if (error && error.stack) {
      errorToLog.stack = error.stack;
    }

    logErrorToServer(errorToLog, {
      context: 'api-rejected',
      additionalInfo: {
        actionType: action.type,
        // You could include action.meta.arg here if you want to log the arguments passed to the thunk
        // Be cautious about logging sensitive data from thunk arguments.
        // userId: store.getState().auth.userId, // Get userId from Redux state
      },
    });
  }

  return next(action);
};

export default errorLoggingMiddleware;
