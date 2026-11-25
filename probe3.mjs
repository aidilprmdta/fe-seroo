import { OutletsApi } from "./src/api/api.js";

const mockRequest = {
  async get(path) {
    console.log("MOCK get called with:", JSON.stringify(path));
    const res = { success: true, data: { outlets: [{ id: "outlet-1", name: "Outlet Rumbai" }] } };
    console.log("MOCK get returning:", JSON.stringify(res));
    return res;
  },
};

const api = new OutletsApi(mockRequest);
console.log("api.request keys:", Object.keys(api.request));
console.log("api.request === mockRequest:", api.request === mockRequest);

const orig = OutletsApi.prototype.listOutlets;
OutletsApi.prototype.listOutlets = async function () {
  console.log("INSIDE orig - this.request === mockRequest:", this.request === mockRequest);
  const response = await orig.call(this);
  console.log("INSIDE orig - response keys:", Object.keys(response || {}));
  return response;
};

const data = await api.listOutlets();
console.log("OUTSIDE - result keys:", Object.keys(data || {}));
