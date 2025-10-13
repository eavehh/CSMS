import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('transactions')
export class Transaction {
    @PrimaryColumn()
    id!: string; // Строковый ID

    @Column()
    chargePointId!: string;

    @Column()
    connectorId!: number;

    @CreateDateColumn()
    startTime!: Date;

    @Column({ nullable: true })
    stopTime?: Date;

    @Column({ nullable: true })
    meterStart?: number;

    @Column({ nullable: true })
    meterStop?: number;

    @Column({ nullable: true })
    energy?: number;

    @Column({ nullable: true })
    totalKWh?: number;

    @Column({ nullable: true })
    cost?: number;

    @Column({ nullable: true })
    efficiencyPercentage?: number;

    @Column({ nullable: true })
    idTag?: string;

    @Column({ nullable: true })
    reason?: string;

    @Column({ type: 'jsonb', nullable: true })
    transactionData?: any[];
}