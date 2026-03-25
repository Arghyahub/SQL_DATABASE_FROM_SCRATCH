import fs from "node:fs/promises";
import constant from "../constant";
import { z } from "zod";
import path from "path";

class Helper {
  public static async getTableMetadata() {
    const allTablesFs = await fs.readFile(constant.getMetaDirPath(), "utf-8");
    const allTablesParsed = constant.tableSchemaArr.parse(
      JSON.parse(allTablesFs),
      {
        error: (_) => "[getTableMetadata] The table meta data is corrupted",
      },
    );
    return allTablesParsed;
  }

  public static async updateTableMetadata(
    allTables: z.infer<typeof constant.tableSchemaArr>,
  ) {
    const parsedTableData = constant.tableSchemaArr.parse(allTables, {
      error: (_) => "[updateTableMetadata] The table meta data is corrupted",
    });

    await fs.writeFile(
      constant.getMetaDirPath(),
      JSON.stringify(parsedTableData, null, 2),
      "utf-8",
    );
  }

  public static async createTableStorageFile(tableName: string) {
    const newStorageFile = constant.getTableStoragePath(tableName, "csv");
    await fs.writeFile(newStorageFile, "", "utf-8");
  }
}

export default Helper;
