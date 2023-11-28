import React, { useState, useEffect } from "react";
import { NFTStorage, File } from "nft.storage";
import { Buffer } from "buffer";
import { ethers } from "ethers";
import axios from "axios";
import Spinner from "react-bootstrap/Spinner";
import Navigation from "./components/Navigation";
import NFT from "./abis/NFT.json";
import config from "./config.json";

function App() {
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState(null);
  const [nft, setNFT] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);
  const [url, setURL] = useState(null);
  const [message, setMessage] = useState("");
  const [isWaiting, setIsWaiting] = useState(false);

  const loadBlockchainData = async () => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    setProvider(provider);
    const network = await provider.getNetwork();
    const nft = new ethers.Contract(
      "0xbB45f9a922D91CEB619e7A119ABE197AAa840558",
      NFT,
      provider
    );
    setNFT(nft);
  };

  const createImage = async () => {
    setMessage("Generating Image...");
    const URL = `https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2`;
    const response = await axios({
      url: URL,
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.REACT_APP_HUGGING_FACE_API_KEY}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      data: JSON.stringify({
        inputs: description,
        options: { wait_for_model: true },
      }),
      responseType: "arraybuffer",
    });
    const type = response.headers["content-type"];
    const data = response.data;
    const base64data = Buffer.from(data).toString("base64");
    const img = `data:${type};base64,` + base64data;
    setImage(img);
    return data;
  };

  const uploadImage = async (imageData) => {
    setMessage("Uploading Image...");
    const nftstorage = new NFTStorage({
      token: process.env.REACT_APP_NFT_STORAGE_API_KEY,
    });
    const { ipnft } = await nftstorage.store({
      image: new File([imageData], "image.jpeg", { type: "image/jpeg" }),
      name: name,
      description: description,
    });
    const url = `https://ipfs.io/ipfs/${ipnft}/metadata.json`;
    setURL(url);
    return url;
  };

  const mintImage = async (tokenURI) => {
    setMessage("Waiting for Mint...");
    const signer = await provider.getSigner();
    const transaction = await nft.connect(signer).mint(tokenURI);
    const receipt = await transaction.wait();
    const tokenId = receipt.events[0].args.tokenId.toNumber();
    return tokenId;
  };

  const addTokenToWallet = async (
    tokenAddress,
    tokenSymbol,
    tokenDecimals,
    tokenImage,
    tokenId
  ) => {
    if (window.ethereum) {
      try {
        await window.ethereum.request({
          method: "wallet_watchAsset",
          params: {
            type: "ERC721",
            options: {
              address: tokenAddress,
              symbol: tokenSymbol,
              decimals: tokenDecimals,
              image: tokenImage,
            },
          },
        });
      } catch (error) {
        console.error("Error adding token to wallet:", error);
      }
    } else {
      console.error("MetaMask not detected");
    }
  };

  const submitHandler = async (e) => {
    e.preventDefault();
    if (name === "" || description === "") {
      window.alert("Please provide a name and description");
      return;
    }
    setIsWaiting(true);
    const imageData = await createImage();
    const url = await uploadImage(imageData);
    const tokenId = await mintImage(url);

    addTokenToWallet(
      "0xbB45f9a922D91CEB619e7A119ABE197AAa840558",
      "NFT",
      0,
      url,
      tokenId
    );
    setIsWaiting(false);
    setMessage("");
  };

  useEffect(() => {
    loadBlockchainData();
  }, []);

  return (
    <div>
      <Navigation account={account} setAccount={setAccount} />
      <div className="form">
        <form onSubmit={submitHandler}>
          <input
            type="text"
            placeholder="Create a name..."
            onChange={(e) => {
              setName(e.target.value);
            }}
          />
          <input
            type="text"
            placeholder="Create a description..."
            onChange={(e) => setDescription(e.target.value)}
          />
          <input type="submit" value="Create & Mint" />
        </form>
        <div className="image">
          {!isWaiting && image ? (
            <img src={image} alt="AI generated image" />
          ) : isWaiting ? (
            <div className="image__placeholder">
              <Spinner animation="border" />
              <p>{message}</p>
            </div>
          ) : (
            <></>
          )}
        </div>
      </div>
      {!isWaiting && url && (
        <p>
          View&nbsp;
          <a href={url} target="_blank" rel="noreferrer">
            Metadata
          </a>
        </p>
      )}
    </div>
  );
}

export default App;
