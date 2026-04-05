export function requestLogger(serverName) {
  return (req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      const line = `[${serverName}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;
      console.log(line);
    });
    next();
  };
}
