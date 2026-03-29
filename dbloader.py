from pymongo import MongoClient, DESCENDING

MONGO_URI = "mongodb+srv://easygadmin:admin123@easyg.kkp1a7a.mongodb.net/?retryWrites=true&w=majority"

def main():
    try:
        print("Connecting to MongoDB...")
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)

        client.admin.command("ping")
        print("Connected successfully!")

        db = client["ecg_hackathon_db"]

        # Create collections if not exist
        collections = ["users", "health_profiles", "ecg_telemetry"]
        for name in collections:
            if name not in db.list_collection_names():
                db.create_collection(name)
                print(f"Created collection: {name}")

        # Indexes (important for performance)
        db.users.create_index("username", unique=True)
        db.health_profiles.create_index("user_id", unique=True)
        db.ecg_telemetry.create_index("user_id")
        db.ecg_telemetry.create_index([("timestamp", DESCENDING)])

        print("Database setup complete!")

    except Exception as e:
        print("Error:", e)


if __name__ == "__main__":
    main()