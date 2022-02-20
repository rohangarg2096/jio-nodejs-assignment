const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const { Table } = require("console-table-printer");
const chalk = require("chalk");

const gainersUrl =
  "https://www.moneycontrol.com/stocks/marketstats/nsegainer/index.php";
const losersUrl =
  "https://www.moneycontrol.com/stocks/marketstats/nseloser/index.php";

async function getPreviousRunInfo(filename) {
  const fileExists = fs.existsSync(filename); // For the first run check if file exists
  try {
    // File can be empty
    return fileExists ? JSON.parse(fs.readFileSync(filename).toString()) : null;
  } catch (err) {
    return null;
  }
}

function computeGainLossSinceLastRun(staleInfo, companyInfo) {
  if (staleInfo) {
    const infoFromPreviousRun = staleInfo.filter(
      (obj) => obj.companyName === companyInfo.companyName
    )[0];

    if (infoFromPreviousRun) {
      companyInfo.gainLossSinceLastRun = Number(
        (
          ((companyInfo.lastPrice - infoFromPreviousRun.lastPrice) * 100) /
          infoFromPreviousRun.lastPrice
        ).toFixed(2)
      );
    } else {
      companyInfo.gainLossSinceLastRun = "New Entrant";
    }
  } else {
    companyInfo.gainLossSinceLastRun = "New Entrant";
  }
}

function printInfoTable(tableTitle, isGainerTable, info) {
  const table = new Table({
    title: tableTitle,
    columns: [
      {
        name: "companyName",
        title: "Company Name",
        alignment: "left",
        color: "cyan",
      },
      { name: "high", title: "High", alignment: "right", color: "yellow" },
      { name: "low", title: "Low", alignment: "right", color: "yellow" },
      {
        name: "lastPrice",
        title: "Last Price",
        alignment: "right",
        color: "yellow",
      },
      {
        name: "prevClose",
        title: "Prev Close",
        alignment: "right",
        color: "yellow",
      },
      { name: "change", title: "Change", alignment: "right", color: "magenta" },
      {
        name: "gainOrLossPct",
        title: isGainerTable ? "%Gain" : "%Loss",
        color: isGainerTable ? "green" : "red",
        alignment: "right",
      },
    ],
    computedColumns: [
      {
        name: "Gain/Loss since last run",
        function: (row) => {
          const val = row.gainLossSinceLastRun;
          if (typeof val === "number") {
            if (val === 0) return chalk.blue(val + "%");
            else if (val > 0) return chalk.green(val + "%");
            else return chalk.red(val + "%");
          } else return chalk.blue(val);
        },
        alignment: "right",
      },
    ],
    disabledColumns: ["gainLossSinceLastRun"],
  });
  table.addRows(info);
  table.printTable();
  console.log("");
}

async function scrapeInfo(filename, url, isGainerTable) {
  try {
    //Get info from file from previous run
    const staleInfo = await getPreviousRunInfo(filename);

    //Fetch data for current run
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const informationTable = $(".hist_tbl_hm table");
    const informationRows = $(informationTable[0]) //The first table having above class has the required information
      .children("tbody")
      .children("tr");
    const tableInfo = [];
    //Loop through obtained data rows to extract data
    informationRows.each((idx, el) => {
      const companyInfo = {
        companyName: "",
        high: 0,
        low: 0,
        lastPrice: 0,
        prevClose: 0,
        change: 0,
        gainOrLossPct: 0,
        gainLossSinceLastRun: "",
      };

      const columns = $(el).children("td");
      companyInfo.companyName = $(columns[0])
        .children("span")
        .children("h3")
        .text();
      companyInfo.high = Number($(columns[1]).text().replace(/\,/g, ""));
      companyInfo.low = Number($(columns[2]).text().replace(/\,/g, ""));
      companyInfo.lastPrice = Number($(columns[3]).text().replace(/\,/g, ""));
      companyInfo.prevClose = Number($(columns[4]).text().replace(/\,/g, ""));
      companyInfo.change = Number($(columns[5]).text().replace(/\,/g, ""));
      companyInfo.gainOrLossPct = Number(
        $(columns[6]).text().replace(/\,/g, "")
      );

      //Check and populate % gain or loss since last run of script
      computeGainLossSinceLastRun(staleInfo, companyInfo);

      tableInfo.push(companyInfo);
    });

    // Write tableInfo to a file
    fs.writeFile(filename, JSON.stringify(tableInfo, null, 2), (err) => {
      if (err) {
        console.error(err);
        return;
      }
    });

    //Write data to table on console
    tableTitle = isGainerTable ? "Gainers Information" : "Losers Information";
    printInfoTable(tableTitle, isGainerTable, tableInfo);
  } catch (err) {
    console.error(err);
  }
}

scrapeInfo("gainers.json", gainersUrl, true);
scrapeInfo("losers.json", losersUrl, false);
