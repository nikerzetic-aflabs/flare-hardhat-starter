import { agencyAddress } from "./config";
import { WeatherIdAgencyInstance } from "../../../typechain-types";
import {
    prepareAttestationRequestBase,
    submitAttestationRequest,
    retrieveDataAndProofBaseWithRetry,
} from "../../utils/fdc";
import { sleep } from "scripts/utils/core";

const { WEB2JSON_VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET, COSTON2_DA_LAYER_URL } = process.env;

const WeatherIdAgency = artifacts.require("WeatherIdAgency");

// yarn hardhat run scripts/weatherInsurance/weatherId/resolvePolicy.ts --network coston2

const policyId = 0;

// Request data
const apiId = process.env.OPEN_WEATHER_API_KEY ?? "";
const units = "metric";

const apiUrl = "https://api.openweathermap.org/data/2.5/weather";
const httpMethod = "GET";
const headers = JSON.stringify({ "Content-Type": "application/json" });
const body = "{}";

const postProcessJq = `{
latitude: (.coord.lat | if . != null then .*pow(10;6) else null end),
longitude: (.coord.lon | if . != null then .*pow(10;6) else null end),
weatherId: .weather[0].id,
weatherMain: .weather[0].main,
description: .weather[0].description,
temperature: (.main.temp | if . != null then .*pow(10;6) else null end),
windSpeed: (.wind.speed | if . != null then . *pow(10;6) end),
windDeg: .wind.deg
}`;

const abiSignature = `{
          "components": [
            {
              "internalType": "int256",
              "name": "latitude",
              "type": "int256"
            },
            {
              "internalType": "int256",
              "name": "longitude",
              "type": "int256"
            },
            {
              "internalType": "uint256",
              "name": "weatherId",
              "type": "uint256"
            },
            {
              "internalType": "string",
              "name": "weatherMain",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "description",
              "type": "string"
            },
            {
              "internalType": "uint256",
              "name": "temperature",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "windSpeed",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "windDeg",
              "type": "uint256"
            }
          ],
          "name": "dto",
          "type": "tuple"
        }`;

// Configuration constants
const attestationTypeBase = "Web2Json";
const sourceIdBase = "PublicWeb2";
const verifierUrlBase = WEB2JSON_VERIFIER_URL_TESTNET;

async function getPolicy(agency: WeatherIdAgencyInstance, id: number) {
    const response = await agency.registeredPolicies(id);
    const policy = {
        latitude: response.latitude,
        longitude: response.longitude,
        startTimestamp: response.startTimestamp,
        expirationTimestamp: response.expirationTimestamp,
        minTempThreshold: response.minTempThreshold,
        premium: response.premium,
        coverage: response.coverage,
        status: response.status,
        id: response.id,
    };
    console.log("Policy:", policy, "\n");
    return policy;
}

function prepareQueryParams(policy: any) {
    const queryParams = {
        lat: policy.latitude / 10 ** 6,
        lon: policy.longitude / 10 ** 6,
        units: units,
        appid: apiId,
    };
    return JSON.stringify(queryParams);
}

async function prepareAttestationRequest(
    apiUrl: string,
    httpMethod: string,
    headers: string,
    queryParams: string,
    body: string,
    postProcessJq: string,
    abiSignature: string
) {
    const requestBody = {
        url: apiUrl,
        httpMethod: httpMethod,
        headers: headers,
        queryParams: queryParams,
        body: body,
        postProcessJq: postProcessJq,
        abiSignature: abiSignature,
    };

    console.log(
        `Query string: ${apiUrl}?${queryParams.replaceAll(":", "=").replaceAll(",", "&").replaceAll("{", "").replaceAll("}", "").replaceAll('"', "")}\n`
    );

    const url = `${verifierUrlBase}Web2Json/prepareRequest`;
    const apiKey = VERIFIER_API_KEY_TESTNET;

    return await prepareAttestationRequestBase(url, apiKey, attestationTypeBase, sourceIdBase, requestBody);
}

async function retrieveDataAndProof(abiEncodedRequest: string, roundId: number) {
    const url = `${COSTON2_DA_LAYER_URL}api/v1/fdc/proof-by-request-round-raw`;
    console.log("Url:", url, "\n");
    return await retrieveDataAndProofBaseWithRetry(url, abiEncodedRequest, roundId);
}

async function resolvePolicy(agency: WeatherIdAgencyInstance, id: number, proof: any) {
    // A piece of black magic that allows us to read the response type from an artifact
    const IWeb2JsonVerification = await artifacts.require("IWeb2JsonVerification");
    const responseType = IWeb2JsonVerification._json.abi[0].inputs[0].components[1];

    const decodedResponse = web3.eth.abi.decodeParameter(responseType, proof.response_hex);

    while (true) {
        try {
            const transaction = await agency.resolvePolicy(id, {
                merkleProof: proof.proof,
                data: decodedResponse,
            });
            console.log("Transaction:", transaction.tx, "\n");
            break;
        } catch (error) {
            console.log("Error:", error, "\n");
            await sleep(20000);
        }
    }
}

async function main() {
    const agency: WeatherIdAgencyInstance = await WeatherIdAgency.at(agencyAddress);
    console.log("WeatherIdAgency:", agency.address, "\n");

    const policy = await getPolicy(agency, policyId);

    const queryParams = prepareQueryParams(policy);

    const data = await prepareAttestationRequest(
        apiUrl,
        httpMethod,
        headers,
        queryParams,
        body,
        postProcessJq,
        abiSignature
    );
    console.log("Data:", data, "\n");
    const abiEncodedRequest = data.abiEncodedRequest;

    const roundId = await submitAttestationRequest(abiEncodedRequest);

    const proof = await retrieveDataAndProof(abiEncodedRequest, roundId);

    await resolvePolicy(agency, policyId, proof);
}

void main().then(() => {
    process.exit(0);
});
