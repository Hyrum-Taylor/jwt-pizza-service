// Use this file to for all the code necessary to interact with Grafana
const os = require('os');
const config = require('./config.js');

class Metrics {
  constructor() {
    this.totalRequests = 0;
    this.postRequests = 0;
    this.deleteRequests = 0;
    this.getRequests = 0;
    this.putRequests = 0;

    // This will periodically send metrics to Grafana
    setInterval(() => {
      this.sendMetricToGrafana('request', 'all', 'total', this.totalRequests);
      this.sendMetricToGrafana('request', 'delete', 'total', this.deleteRequests);
      this.sendMetricToGrafana('request', 'post', 'total', this.postRequests);
      this.sendMetricToGrafana('request', 'get', 'total', this.getRequests);
      this.sendMetricToGrafana('request', 'put', 'total', this.putRequests);

      this.sendMetricToGrafana('resources', 'memory', 'current', this.getMemoryUsagePercentage());
      this.sendMetricToGrafana('resources', 'cpu', 'current', this.getCpuUsagePercentage());
    }, 10000).unref();
  }

  incrementRequests() {
    this.totalRequests++;
  }

  incrementDeleteRequests() {
    this.deleteRequests++;
    this.incrementRequests();
  }

  incrementPostRequests() {
    this.postRequests++;
    this.incrementRequests();
  }

  incrementGetRequests() {
    this.getRequests++;
    this.incrementRequests();
  }

  incrementPutRequests() {
    this.putRequests++;
    this.incrementRequests();
  }

  getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;
    return memoryUsage.toFixed(2);
  }

  getCpuUsagePercentage() {
    const cpuUsage = os.loadavg()[0] / os.cpus().length;
    return cpuUsage.toFixed(2) * 100;
  }

  sendMetricToGrafana(metricPrefix, httpMethod, metricName, metricValue) {
    console.log(config.metrics.source);
    const metric = `${metricPrefix},source=${config.metrics.source},method=${httpMethod} ${metricName}=${metricValue}`;

    fetch(`${config.metrics.url}`, {
      method: 'post',
      body: metric,
      headers: { Authorization: `Bearer ${config.metrics.userId}:${config.metrics.apiKey}` },
    })
      .then((response) => {
        if (!response.ok) {
          console.error('Failed to push metrics data to Grafana');
        } else {
          console.log(`Pushed ${metric}`);
        }
      })
      .catch((error) => {
        console.error('Error pushing metrics:', error);
      });
  }
}

const metrics = new Metrics();
module.exports = metrics;
