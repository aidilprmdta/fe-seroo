import { OutletsApi } from "./src/api/api.js";

const orig = OutletsApi.prototype.listOutlets;
OutletsApi.prototype.listOutlets = async function () {
  const response = await orig.call(this);
  console.log("INSIDE listOutlets - response keys:", Object.keys(response || {}));
  console.log("INSIDE listOutlets - response.data keys:", response ? Object.keys(response?.data) : "null");
  return response;
};

const mockRequest = {
  async get(path) {
    return { success: true, data: { outlets: [{ id: "outlet-1", name: "Outlet Rumbai" }] } };
  },
};
const api = new OutletsApi(mockRequest);
const data = await api.listOutlets();
console.log("OUTSIDE - result keys:", Object.keys(data || {}));
