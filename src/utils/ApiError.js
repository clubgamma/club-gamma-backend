class ApiError extends Error {
    constructor(statusCode, message = "Something went wrong", errors = []) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.errors =  typeof(errors) === Array ? errors : [errors];
        this.data = null;
    }
}

module.exports = ApiError;
