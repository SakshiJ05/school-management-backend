import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const sequelize = new Sequelize(
  process.env.MYSQL_DATABASE || 'scholify',
  process.env.MYSQL_USER || 'root',
  process.env.MYSQL_PASSWORD || '',
  {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT) || 3306,
    dialect: 'mysql',
    logging: process.env.DB_LOGGING === 'true' ? console.log : false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    define: {
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
);

export async function connectDatabase() {
  await sequelize.authenticate();
  console.log(`MySQL connected → ${process.env.MYSQL_DATABASE || 'scholify'}`);
  return sequelize;
}

export async function syncDatabase(options = {}) {
  const { force = false, alter = false } = options;
  await sequelize.sync({ force, alter });
  console.log(`Database synced (force=${force}, alter=${alter})`);
}

export default sequelize;
