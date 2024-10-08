const { PrismaClient } = require("@prisma/client");

class Prisma extends PrismaClient {
    constructor(options = {}) {
        super(options);

    }
    // implement chaching in future maybe
}

const prisma = new Prisma();
module.exports = prisma;
