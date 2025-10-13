import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class MeterValue {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column()
    transactionId?: string;

    @Column()
    connectorId?: number;

    @Column()
    timestamp!: Date;

    @Column('jsonb')
    sampledValue: any; // или: sampledValue: object
}