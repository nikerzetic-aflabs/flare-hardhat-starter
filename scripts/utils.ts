import hre, { web3, ethers } from "hardhat";
import {
  coston,
  coston2,
  songbird,
  flare,
} from "@flarenetwork/flare-periphery-contract-artifacts";

export async function getProvider() {
  const network = hre.network.name;
  if (network === "coston")
    return new ethers.JsonRpcProvider(process.env.COSTON_RPC_URL);
  if (network === "coston2")
    return new ethers.JsonRpcProvider(process.env.COSTON2_RPC_URL);
  if (network === "songbird")
    return new ethers.JsonRpcProvider(process.env.SONGBIRD_RPC_URL);
  if (network === "flare")
    return new ethers.JsonRpcProvider(process.env.FLARE_RPC_URL);
  throw new Error(
    `Unsupported network "${network}". Supported networks are flare, coston2, songbird and coston.`
  );
}

export async function getRelay() {
  const network = hre.network.name;
  const provider = await getProvider();
  if (network === "coston")
    return new web3.eth.Contract(
      coston.interfaceAbis.IRelay,
      await coston.products.Relay.getAddress(provider)
    );
  if (network === "coston2")
    return new web3.eth.Contract(
      coston2.interfaceAbis.IRelay,
      await coston2.products.Relay.getAddress(provider)
    );
  if (network === "songbird")
    return new web3.eth.Contract(
      songbird.interfaceAbis.IRelay,
      await songbird.products.Relay.getAddress(provider)
    );
  if (network === "flare")
    return new web3.eth.Contract(
      flare.interfaceAbis.IRelay,
      await flare.products.Relay.getAddress(provider)
    );
  throw new Error(
    `Unsupported network "${network}". Supported networks are flare, coston2, songbird and coston.`
  );
}
