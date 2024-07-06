import {
  variants,
  exercises,
  exercisesCategories,
  exercisesDescriptions,
} from "../../db/schemas";
import { CreateExerciseDescriptionDto } from "../../../domain/dtos/exercise/create-exercise-description.dto";
import {and, count, eq, ilike, isNull, or} from "drizzle-orm";
import { ExerciseDescriptionEntity } from "../../../domain/entities/exercise/exercise-description.entity";
import { ExerciseCategoryEntity } from "../../../domain/entities/exercise/exercise-category.entity";
import { ExerciseRepository } from "../../../domain/repositories/exercise/exercise.repository";
import { CreateExerciseDto } from "../../../domain/dtos/exercise/create-exercise.dto";
import { CreateVariantDto } from "../../../domain/dtos/exercise/create-variant.dto";
import { UpdateVariantDto } from "../../../domain/dtos/exercise/update-variant.dto";
import { ExerciseEntity } from "../../../domain/entities/exercise/exercise.entity";
import { VariantEntity } from "../../../domain/entities/exercise/variant.entity";
import { CustomError } from "../../../domain/errors/custom.error";
import { db } from "../../db";

export class ExerciseRepositoryImpl implements ExerciseRepository {
  async createExercise(
    createExerciseDto: CreateExerciseDto
  ): Promise<ExerciseEntity | CustomError> {
    try {
      const [newExercise] = await db
        .insert(exercises)
        .values({ ...createExerciseDto })
        .returning({
          id: exercises.id,
          name: exercises.name,
          video: exercises.video,
          category: exercises.categoryId,
          image: exercises.image,
          user: exercises.userId,
        });

      if (!newExercise) {
        throw CustomError.internalServer("Error creating the exercise");
      }

      const [exerciseCategory] = await db
        .select()
        .from(exercisesCategories)
        .where(eq(exercisesCategories.id, newExercise.category));

      return ExerciseEntity.create({
        ...newExercise,
        category: ExerciseCategoryEntity.create(exerciseCategory),
        hasUser: Boolean(newExercise.user),
      });
    } catch (error: unknown) {
      console.log(error);
      if (error instanceof CustomError) {
        throw error;
      }
      throw CustomError.internalServer();
    }
  }
  async createVariant(
    createVariantDto: CreateVariantDto
  ): Promise<VariantEntity | CustomError> {
    try {
      const [newVariant] = await db
        .insert(variants)
        .values({ ...createVariantDto })
        .returning({
          id: variants.id,
          name: variants.name,
          video: variants.video,
          category: variants.categoryId,
          image: variants.image,
        });

      const [variantCategory] = await db
        .select()
        .from(exercisesCategories)
        .where(eq(exercisesCategories.id, newVariant.category));

      return VariantEntity.create({
        ...newVariant,
        category: ExerciseCategoryEntity.create(variantCategory),
      });
    } catch (error: unknown) {
      if (error instanceof CustomError) {
        throw error;
      }

      throw CustomError.internalServer();
    }
  }
  async createExerciseDescription(
    createExerciseDescriptionDto: CreateExerciseDescriptionDto
  ): Promise<ExerciseDescriptionEntity | CustomError> {
    try {
      const [newExerciseDescription] = await db
        .insert(exercisesDescriptions)
        .values({ ...createExerciseDescriptionDto })
        .returning({
          id: exercisesDescriptions.id,
          description: exercisesDescriptions.description,
        });

      if (!newExerciseDescription) {
        throw CustomError.internalServer("Error creating the description");
      }

      return ExerciseDescriptionEntity.create(newExerciseDescription);
    } catch (error: unknown) {
      console.log(error);
      if (error instanceof CustomError) {
        throw error;
      }
      throw CustomError.internalServer();
    }
  }

    async readExercises(
        userId: string,
        name?: string,
        categoryId?: number,
        page?: number,
        pageSize?: number
    ): Promise<{ exercises: ExerciseEntity[], totalItems: number } | CustomError> {
        try {
            // Construir las condiciones dinámicas
            const conditions: any[] = [
                or(isNull(exercises.userId), eq(exercises.userId, userId))
            ];

            if (name) {
                conditions.push(
                    or(
                        ilike(exercises.name, `%${name}%`),
                        ilike(variants.name, `%${name}%`)
                    )
                );
            }

            if (categoryId) {
                conditions.push(eq(exercises.categoryId, Number(categoryId)));
            }

            console.log('Conditions:', categoryId);

            // Calcular el offset para la paginación
            const offset = ((page ?? 1) - 1) * (pageSize ?? 10);

            // Obtener el total de ejercicios
            const totalItemsResult = await db
                .select({ value: count() })
                .from(exercises)
                .leftJoin(variants, and(eq(variants.exerciseId, exercises.id), eq(variants.userId, userId))) // Asegúrate de incluir esta línea
                .where(and(...conditions));

            const totalItems = Number(totalItemsResult[0].value);

            // Obtener los ejercicios paginados
            const exercisesList = await db
                .select({
                    main: exercises,
                    variant: variants,
                    category: exercisesCategories,
                    user: exercises.userId,
                })
                .from(exercises)
                .leftJoin(
                    exercisesCategories,
                    eq(exercisesCategories.id, exercises.categoryId)
                )
                .leftJoin(
                    variants,
                    and(
                        eq(variants.exerciseId, exercises.id),
                        eq(variants.userId, userId)
                    )
                )
                .where(and(...conditions))
                .limit(pageSize ?? 10)
                .offset(offset);

            // Mapear los resultados a las entidades correspondientes
            const exercisesEntities = exercisesList.map((exercise) =>
                ExerciseEntity.create({
                    ...exercise.main,
                    variant: exercise.variant
                        ? VariantEntity.create({
                            ...exercise.variant,
                            category: ExerciseCategoryEntity.create(exercise.category!),
                        })
                        : null,
                    category: ExerciseCategoryEntity.create(exercise.category!),
                    hasUser: Boolean(exercise.user),
                })
            );

            // Devolver los ejercicios paginados y el total de elementos
            return {
                exercises: exercisesEntities,
                totalItems: totalItems
            };
        } catch (error: unknown) {
            console.log(error);
            if (error instanceof CustomError) {
                throw error;
            }
            throw CustomError.internalServer();
        }
    }

    async readExercisesCategories(): Promise<
    ExerciseCategoryEntity[] | CustomError
  > {
    try {
      const exercisesCategoriesList = await db
        .select({
          id: exercisesCategories.id,
          name: exercisesCategories.name,
        })
        .from(exercisesCategories);

      return exercisesCategoriesList.map((exerciseCategory) =>
        ExerciseCategoryEntity.create(exerciseCategory)
      );
    } catch (error: unknown) {
      console.log(error);
      if (error instanceof CustomError) {
        throw error;
      }
      throw CustomError.internalServer();
    }
  }
  async readExercisesDescriptions(
    userId: string
  ): Promise<ExerciseDescriptionEntity[] | CustomError> {
    try {
      const exercisesDescriptionsList = await db
        .select({
          id: exercisesDescriptions.id,
          description: exercisesDescriptions.description,
        })
        .from(exercisesDescriptions)
        .where(eq(exercisesDescriptions.userId, userId));

      return exercisesDescriptionsList.map((exerciseDescription) =>
        ExerciseDescriptionEntity.create(exerciseDescription)
      );
    } catch (error: unknown) {
      console.log(error);
      if (error instanceof CustomError) {
        throw error;
      }
      throw CustomError.internalServer();
    }
  }
  async updateVariant(
    updateVariantDto: UpdateVariantDto
  ): Promise<VariantEntity | CustomError> {
    try {
      const { name, video, userId, categoryId, image, variantId } =
        updateVariantDto;

      const [updatedVariant] = await db
        .update(variants)
        .set({
          name: name,
          video: video,
          userId: userId,
          categoryId: categoryId,
          image: image,
        })
        .where(eq(variants.id, variantId))
        .returning({
          id: variants.id,
          name: variants.name,
          video: variants.video,
          category: variants.categoryId,
          image: variants.image,
        });

      if (!updatedVariant) {
        throw CustomError.internalServer("Error creating the variant");
      }

      const [variantCategory] = await db
        .select()
        .from(exercisesCategories)
        .where(eq(exercisesCategories.id, updatedVariant.category));

      return VariantEntity.create({
        ...updatedVariant,
        category: ExerciseCategoryEntity.create(variantCategory),
      });
    } catch (error: unknown) {
      console.log(error);
      if (error instanceof CustomError) {
        throw error;
      }
      throw CustomError.internalServer();
    }
  }
}
