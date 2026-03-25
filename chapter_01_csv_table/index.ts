import fs from "fs";
import { z } from "zod";
import constant from "../constant";
import Helper from "./helper";
import Tester from "../tester";

class DB {
  public constructor() {
    constant.setDirName(__dirname);
    fs.mkdirSync(constant.getDirPath(), { recursive: true });
    fs.writeFileSync(constant.getMetaDirPath(), "[]", "utf-8");
  }

  public async createTable(tableData: z.infer<typeof constant.tableSchema>) {
    const allTables = await Helper.getTableMetadata();

    const tableAlreadyExists = allTables.find(
      (table) => table.table_name === tableData.table_name,
    );
    if (tableAlreadyExists) throw new Error("Table already exists");

    allTables.push(tableData);
    await Helper.updateTableMetadata(allTables);

    await Helper.createTableStorageFile(tableData.table_name);
  }

  public async insertIntoTable(
    tableName: string,
    rowData: Record<string, any>,
  ) {}
}

const db = new DB();

const tester = new Tester({
  getTableMetadata: Helper.getTableMetadata,
});

tester.init();
